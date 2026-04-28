export const metadata = {
  title: "Join Our Private Telegram Channel",
  description: "Exclusive community — get instant access now.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#0b0c10" }}>
        {children}
      </body>
    </html>
  );
}
