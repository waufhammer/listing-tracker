import { Metadata } from "next";
import GetYourLink from "@/components/GetYourLink";
import { CONTACT_EMAIL, contactPhone } from "@/lib/client-access";

export const metadata: Metadata = {
  title: "Get your link",
  robots: { index: false, follow: false },
};

// Where an unknown or reset /s/<token> link lands. Same form as a locked
// client page, but without a listing: the email is matched against sellers
// on every active listing.
export default function LinkExpiredPage() {
  return <GetYourLink expired contactEmail={CONTACT_EMAIL} contactPhone={contactPhone()} />;
}
