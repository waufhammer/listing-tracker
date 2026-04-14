import { NextResponse } from 'next/server';
import { getListings, createListing } from '@/lib/airtable';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const listings = await getListings();
    return NextResponse.json(listings);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const token = uuidv4();

    const listing = await createListing({
      'Property Address': body.address,
      'Listing Date': body.listingDate || null,
      'List Price': body.listPrice || '',
      'Status': body.status || 'Active',
      'Public Token': token,
      'Zillow URL': body.zillowUrl || '',
      'Redfin URL': body.redfinUrl || '',
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
