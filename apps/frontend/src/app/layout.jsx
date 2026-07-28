import './globals.css';

export const runtime = 'edge';

export const metadata = {
  title: 'Code Plus Academy — Admin Platform',
  description: 'Trust, Safety & Moderation Platform for Code Plus Academy',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div id="admin-app">
          {children}
        </div>
      </body>
    </html>
  );
}
