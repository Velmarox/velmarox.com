// Puts the icon and version details on Clack Arena.exe. electron-builder does this with rcedit, which needs Windows
// (or Wine); resedit does the same in plain JavaScript, so the app can be built on any machine.
const path = require('node:path');
const fs = require('node:fs');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const { NtExecutable, NtExecutableResource, Resource, Data } = await import('resedit');
  const app = ctx.packager.appInfo;
  const exe = path.join(ctx.appOutDir, `${app.productFilename}.exe`);
  const pe = NtExecutable.from(fs.readFileSync(exe));
  const res = NtExecutableResource.from(pe);

  const ico = Data.IconFile.from(fs.readFileSync(path.join(ctx.packager.info.buildResourcesDir, 'icon.ico')));
  const old = Resource.IconGroupEntry.fromEntries(res.entries);
  Resource.IconGroupEntry.replaceIconsForResource(res.entries, old.length ? old[0].id : 1, old.length ? old[0].lang : 1033, ico.icons.map((i) => i.data));

  const [vi] = Resource.VersionInfo.fromEntries(res.entries);
  const v = app.version.split('.').map(Number);
  vi.setFileVersion(v[0], v[1], v[2], 0, 1033);
  vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'Clack Arena', ProductName: 'Clack Arena', CompanyName: 'VRX Games',
    LegalCopyright: app.copyright, OriginalFilename: `${app.productFilename}.exe`, InternalName: 'Clack Arena',
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(pe);
  fs.writeFileSync(exe, Buffer.from(pe.generate()));
  console.log('  • icon and version info set on', path.basename(exe));
};
