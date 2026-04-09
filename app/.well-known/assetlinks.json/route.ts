/**
 * GET /.well-known/assetlinks.json
 *
 * Required for Trusted Web Activity (TWA) so the installed Android app
 * does NOT show the Chrome address bar.
 *
 * How to fill this in:
 *  1. Build your TWA with PWABuilder or Bubblewrap.
 *  2. Find your keystore SHA-256 fingerprint:
 *       keytool -list -v -keystore release.keystore -alias <alias>
 *     or from Play Console:  Setup → App Integrity → App signing certificate.
 *  3. Set the env var ASSETLINKS_SHA256_CERT to that fingerprint
 *     (colons between bytes, e.g. "AB:CD:EF:...").
 *  4. Set ASSETLINKS_PACKAGE_NAME to your app's package name
 *     (e.g. "com.elpuebloduerme.app").
 *
 * Until these env vars are set the endpoint still returns valid JSON so the
 * route works — TWA verification will simply fail until the real values are
 * filled in.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export function GET() {
  const sha256 = process.env.ASSETLINKS_SHA256_CERT ?? 'REEMPLAZA_CON_TU_SHA256_FINGERPRINT';
  const packageName = process.env.ASSETLINKS_PACKAGE_NAME ?? 'com.elpuebloduerme.app';

  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: [sha256],
      },
    },
  ];

  return new NextResponse(JSON.stringify(assetLinks, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
