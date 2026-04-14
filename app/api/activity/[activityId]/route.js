import { NextResponse } from 'next/server';
import { updateActivity, deleteActivity } from '@/lib/airtable';

export async function PATCH(request, { params }) {
  try {
    const body = await request.json();

    const fields = {};
    if (body.date !== undefined) fields['Date'] = body.date;
    if (body.type !== undefined) fields['Type'] = body.type;
    if (body.agentName !== undefined) fields['Agent Name'] = body.agentName;
    if (body.followUpSent !== undefined) fields['Follow Up Text Sent'] = body.followUpSent;
    if (body.buyerPacketRequested !== undefined) fields['Agent Requested Buyer Packet'] = body.buyerPacketRequested;
    if (body.feedback !== undefined) fields['Feedback'] = body.feedback;
    if (body.openHouseGroups !== undefined) fields['Open House Groups'] = Number(body.openHouseGroups);

    const activity = await updateActivity(params.activityId, fields);
    return NextResponse.json(activity);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await deleteActivity(params.activityId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
