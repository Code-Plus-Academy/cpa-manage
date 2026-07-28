/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com'}/admin/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
