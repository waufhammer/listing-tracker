import { NextResponse } from 'next/server';
import { createActivity } from '@/lib/airtable';

export async function POST(request) {
  try {
    const body = await request.json();

    const fields = {
      'Date': body.date,
      'Type': body.type,
      'Agent Name': body.agentName || '',
      'Follow Up Text Sent': body.followUpSent || false,
      'Agent Requested Buyer Packet': body.buyerPacketRequested || false,
      'Feedback': body.feedback || '',
      'Listing': [body.listingId],
    };

    if (body.type === 'Open House' && body.openHouseGroups) {
      fields['Open House Groups'] = Number(body.openHouseGroups);
    }

    const activity = await createActivity(fields);
    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
