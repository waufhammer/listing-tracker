import './globals.css';

export const metadata = {
  title: 'Listing Activity Tracker',
  description: 'Real estate listing activity dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
