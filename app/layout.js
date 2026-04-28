import "./globals.css";

export const metadata = {
  title: "Join Our Telegram Community",
  description: "Get exclusive access to our private Telegram channel",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
