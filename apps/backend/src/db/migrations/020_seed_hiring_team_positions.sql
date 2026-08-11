-- Migration 020: Seed Code Plus Academy Team Structure Positions
INSERT INTO hiring_positions (title, department, type, status, description, openings, location, requirements, responsibilities, salary_range)
SELECT 'Flutter Mobile Developer (Intern)', 'Mobile Development', 'intern', 'open',
       'Rebuild the web application into native iOS & Android apps following the 10-week FLUTTER_ROADMAP.md. Implement 17 core screens (Feed, Multi-Step Onboarding, User Profile, Video Player, Vertical Shorts, Academic PDF Viewer, Direct Chat).',
       2, 'remote',
       'Flutter, Dart, Riverpod / Provider, REST APIs (dio), Git, basic iOS/Android build setups.',
       'Rebuild web app into native mobile screens, manage local secure token storage and 401 transparent token refresh handling, implement design system tokens.',
       'Competitive Stipend / Internship'
WHERE NOT EXISTS (SELECT 1 FROM hiring_positions WHERE title = 'Flutter Mobile Developer (Intern)');

INSERT INTO hiring_positions (title, department, type, status, description, openings, location, requirements, responsibilities, salary_range)
SELECT 'Senior Flutter Tech Lead (Reviewer / Consultant)', 'Mobile Development', 'contract', 'open',
       '4+ years Flutter experience. Provide clean architecture reviews, set up Codemagic/GitHub Actions CI/CD pipelines, code obfuscation, and oversee Apple TestFlight and Google Play Console release management.',
       1, 'remote',
       '4+ years Flutter experience, Clean Architecture, CI/CD (Codemagic/GitHub Actions), App Store & Play Store publishing.',
       'Perform PR code reviews for Flutter interns, maintain production-grade architecture, configure CI/CD build pipelines, oversee TestFlight & Play Store releases.',
       'Senior Hourly / Retainer'
WHERE NOT EXISTS (SELECT 1 FROM hiring_positions WHERE title = 'Senior Flutter Tech Lead (Reviewer / Consultant)');

INSERT INTO hiring_positions (title, department, type, status, description, openings, location, requirements, responsibilities, salary_range)
SELECT 'Senior Node.js & Database Engineer', 'Backend & Infrastructure', 'full-time', 'open',
       'Architect and resolve critical backend gaps blocking the mobile app. Implement real-time WebSockets (Socket.io) for Direct Messaging, maintain dual-database query performance (socialDb and contentDb), and enforce DPDP Act privacy compliance.',
       1, 'remote',
       'Node.js, Express, PostgreSQL (pg), Redis, Elasticsearch, BullMQ, AWS S3 / Cloudinary, System Architecture.',
       'Architect backend infrastructure, implement Socket.io real-time DM, optimize dual-database raw SQL queries and indexes, integrate FCM Push Notification pipeline.',
       'Senior Competitive Package'
WHERE NOT EXISTS (SELECT 1 FROM hiring_positions WHERE title = 'Senior Node.js & Database Engineer');

INSERT INTO hiring_positions (title, department, type, status, description, openings, location, requirements, responsibilities, salary_range)
SELECT 'Backend Engineering Intern', 'Backend & Infrastructure', 'intern', 'open',
       'Standardize API endpoint routes and parameter naming, implement direct S3 pre-signed upload URLs (GET /api/upload/presign) for video files, write unit & integration tests.',
       1, 'remote',
       'Node.js, Express, SQL basics, Postman / REST API testing, Git.',
       'Standardize API routes and snake_case field conventions, implement S3 pre-signed upload controllers, write unit and integration tests for auth and payment modules.',
       'Internship Stipend'
WHERE NOT EXISTS (SELECT 1 FROM hiring_positions WHERE title = 'Backend Engineering Intern');

INSERT INTO hiring_positions (title, department, type, status, description, openings, location, requirements, responsibilities, salary_range)
SELECT 'Frontend Web Lead (React / Next.js)', 'Web Frontend & Creator Studio', 'full-time', 'open',
       'Maintain and enhance the web application (Front-end) and AI Creator Studio (Back-end/studio). Fix client-side hydration issues, gRPC microservice integration (cpaservices.proto), and HLS video streaming fallbacks.',
       1, 'remote',
       'Next.js 16 (App Router), React 19, TypeScript, TailwindCSS 4, HLS.js streaming, performance optimization.',
       'Lead web frontend architecture, optimize Core Web Vitals (LCP, INP, CLS), maintain gRPC microservice alignment and HLS video streaming.',
       'Senior Competitive Package'
WHERE NOT EXISTS (SELECT 1 FROM hiring_positions WHERE title = 'Frontend Web Lead (React / Next.js)');

INSERT INTO hiring_positions (title, department, type, status, description, openings, location, requirements, responsibilities, salary_range)
SELECT 'Frontend Web Intern', 'Web Frontend & Creator Studio', 'intern', 'open',
       'Fix UI layout bugs, responsive mobile-web views, and dark/light theme glitches. Update web forms to enforce strict client-side validation rules matching backend regexes.',
       1, 'remote',
       'React, JavaScript (ES6+), HTML5/CSS3, TailwindCSS, basic API integration via Axios.',
       'Resolve responsive UI layout bugs, update form validations, assist in implementing AI Studio block components.',
       'Internship Stipend'
WHERE NOT EXISTS (SELECT 1 FROM hiring_positions WHERE title = 'Frontend Web Intern');

INSERT INTO hiring_positions (title, department, type, status, description, openings, location, requirements, responsibilities, salary_range)
SELECT 'UI/UX Designer', 'Design & Quality Assurance', 'contract', 'open',
       'Adapt web desktop layouts into clean, touch-friendly mobile screens for Flutter. Design native mobile components: Bottom navigation bars, pull-to-refresh feeds, video player controls, and bottom sheets.',
       1, 'remote',
       'Figma, Mobile Design Systems, Material Design 3, iOS Human Interface Guidelines.',
       'Create mobile Figma design system, design native touch components for iOS and Android, collaborate with Flutter team.',
       'Contract / Project Basis'
WHERE NOT EXISTS (SELECT 1 FROM hiring_positions WHERE title = 'UI/UX Designer');

INSERT INTO hiring_positions (title, department, type, status, description, openings, location, requirements, responsibilities, salary_range)
SELECT 'QA & Automation Testing Intern', 'Design & Quality Assurance', 'intern', 'open',
       'Perform cross-device testing across various Android devices, iPhones, and screen aspect ratios. Execute end-to-end regression tests on authentication, onboarding steps, content publishing, and live DM chat flows.',
       1, 'remote',
       'Manual testing, Postman API testing, Appium / Flutter Integration Test basics, Bug reporting (Jira/GitHub Issues).',
       'Execute cross-device UI and API tests, file detailed issue reports, maintain automated regression test suites.',
       'Internship Stipend'
WHERE NOT EXISTS (SELECT 1 FROM hiring_positions WHERE title = 'QA & Automation Testing Intern');
