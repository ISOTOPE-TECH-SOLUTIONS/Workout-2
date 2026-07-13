import { NextResponse } from 'next/server';
import { supabase, getMemberPaymentSnapshot } from '@/lib/supabase';
import { normalizeDeviceTimestamp } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Only fetch columns needed for payment computation (not photo_url, phone, gender, etc.)
const SCANNER_MEMBER_COLS = 'id,name,package_type,trainer_package_type,has_cardio,trainer_commission,gym_fees,trainer_fees,admission_fee,amount_paid,package_start_date,created_at,payment_date,is_premium,fingerprint_template,zk_id';

const decodeBinaryUserId = (raw: string) => {
  const bytes = Array.from(raw).map((c) => c.charCodeAt(0));
  if (bytes.length === 0) return null;

  const littleEndian = bytes.reduce((acc, byte, index) => acc + byte * (256 ** index), 0);
  if (Number.isFinite(littleEndian) && littleEndian > 0) {
    return String(littleEndian);
  }
  return null;
};

const normalizeUserId = (value: unknown) => {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return raw;

  // Some scanners may emit non-printable bytes for user_id; decode those bytes into decimal.
  if (/[^\x20-\x7E]/.test(raw)) {
    const decoded = decodeBinaryUserId(raw);
    if (decoded) return decoded;
  }

  return raw;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, rawUserId, uid, timestamp } = body;

    // Normalize device timestamp: pyzk sends "2026-04-21 21:10:15" (UTC, no suffix).
    // Append "Z" so JS/Supabase treat it as UTC, not local time.
    const normalizedTimestamp = normalizeDeviceTimestamp(timestamp);

    const normalizedUserId = normalizeUserId(userId ?? rawUserId);
    const fallbackUid = normalizeUserId(uid);

    console.log('[API] Received scan payload', {
      rawUserId: userId ?? rawUserId,
      normalizedUserId,
      fallbackUid,
      rawTimestamp: timestamp,
      normalizedTimestamp,
    });

    // Look up member by fingerprint_template first, then by zk_id.
    // Using separate .eq() queries instead of .or() to avoid PostgREST
    // quoting ambiguity that caused false "member not found" results.
    let member: any = null;

    if (normalizedUserId) {
      const { data: byFingerprint } = await supabase
        .from('members')
        .select(SCANNER_MEMBER_COLS)
        .eq('fingerprint_template', normalizedUserId)
        .limit(1);
      member = byFingerprint?.[0] ?? null;

      if (!member) {
        const { data: byZkId } = await supabase
          .from('members')
          .select(SCANNER_MEMBER_COLS)
          .eq('zk_id', normalizedUserId)
          .limit(1);
        member = byZkId?.[0] ?? null;
      }
    }

    if (!member && fallbackUid) {
      const { data: byFingerprint2 } = await supabase
        .from('members')
        .select(SCANNER_MEMBER_COLS)
        .eq('fingerprint_template', fallbackUid)
        .limit(1);
      member = byFingerprint2?.[0] ?? null;

      if (!member) {
        const { data: byZkId2 } = await supabase
          .from('members')
          .select(SCANNER_MEMBER_COLS)
          .eq('zk_id', fallbackUid)
          .limit(1);
        member = byZkId2?.[0] ?? null;
      }
    }

    if (!member) {
      console.warn('[API] No member found for scanner payload', {
        normalizedUserId,
        fallbackUid,
      });
      
      // Log unknown scan directly to Supabase
      const unknownId = normalizedUserId || fallbackUid || 'UNKNOWN';
      const logPayload: any = { member_id: null, status: 'denied', notes: `Unknown Scanner ID: ${unknownId}` };
      if (normalizedTimestamp) logPayload.timestamp = normalizedTimestamp;
      await supabase.from('attendance_logs').insert([logPayload]);
      
      return NextResponse.json({ 
        error: 'Member not found', 
        log: 'denied',
        status: 'denied',
        notes: `Unknown Scanner ID: ${unknownId}`
      }, { status: 404 });
    }

    const paymentSnapshot = getMemberPaymentSnapshot(member);

    const permission: 'granted' | 'denied' = paymentSnapshot.isDue ? 'denied' : 'granted';
    let overdueReason = '';

    if (paymentSnapshot.isDue) {
      overdueReason = paymentSnapshot.reason || 'Outstanding Balance';
    }

    // Log the attendance with timestamp from payload
    const attendancePayload: any = { member_id: member.id, status: permission, notes: overdueReason };
    if (normalizedTimestamp) attendancePayload.timestamp = normalizedTimestamp;
    await supabase.from('attendance_logs').insert([attendancePayload]);
    console.log(`[API] Successfully logged attendance for ${member.name} (${permission})`);

    return NextResponse.json({ 
      success: true, 
      memberName: member.name, 
      status: permission,
      paymentDue: overdueReason !== '',
      overdueReason: overdueReason,
      timestamp: normalizedTimestamp
    });
  } catch (error) {
    console.error('[API] Error processing scanner POST request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
