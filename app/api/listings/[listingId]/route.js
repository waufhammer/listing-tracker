import { NextResponse } from 'next/server';
import { getListing, updateListing } from '@/lib/airtable';

export async function GET(request, { params }) {
  try {
    const listing = await getListing(params.listingId);
    return NextResponse.json(listing);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const body = await request.json();

    const fields = {};
    if (body.address !== undefined) fields['Property Address'] = body.address;
    if (body.listingDate !== undefined) fields['Listing Date'] = body.listingDate;
    if (body.listPrice !== undefined) fields['List Price'] = body.listPrice;
    if (body.status !== undefined) fields['Status'] = body.status;
    if (body.zillowUrl !== undefined) fields['Zillow URL'] = body.zillowUrl;
    if (body.redfinUrl !== undefined) fields['Redfin URL'] = body.redfinUrl;
    if (body.zillowViews !== undefined) fields['Zillow Views'] = Number(body.zillowViews);
    if (body.redfinViews !== undefined) fields['Redfin Views'] = Number(body.redfinViews);
    if (body.zillowViewsUpdated !== undefined) fields['Zillow Views Updated'] = body.zillowViewsUpdated;
    if (body.redfinViewsUpdated !== undefined) fields['Redfin Views Updated'] = body.redfinViewsUpdated;

    const listing = await updateListing(params.listingId, fields);
    return NextResponse.json(listing);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
