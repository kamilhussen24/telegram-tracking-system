export const metadata = {
  title: "Join Our Private Community",
  description: "Exclusive community — get instant access now.",
};

export default function RootLayout({ children }) {
  const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "";

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* ── Facebook Pixel Base Code ── */}
        {pixelId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
              `,
            }}
          />
        )}
        {pixelId && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}
      </head>
      <body style={{ margin: 0, padding: 0, background: "#0b0c10" }}>
        {children}
      </body>
    </html>
  );
}
