// Depois de empacotar para Windows: põe o ícone e a informação de versão no VidCut.exe.
// Usa o resedit (JavaScript puro), por isso funciona também a empacotar a partir de Linux/macOS sem Wine.
const path = require('node:path');
const fs = require('node:fs');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const { packager, appOutDir } = context;
  const exe = path.join(appOutDir, `${packager.appInfo.productFilename}.exe`);
  const ResEdit = await import('resedit');
  const { NtExecutable, NtExecutableResource, Resource, Data } = ResEdit.default ?? ResEdit;

  const exeData = NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = NtExecutableResource.from(exeData);

  const ico = Data.IconFile.from(fs.readFileSync(path.join(packager.projectDir, 'build', 'icon.ico')));
  Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, ico.icons.map((i) => i.data));

  const v = packager.appInfo.version.split('.').map((n) => parseInt(n, 10) || 0);
  const vi = Resource.VersionInfo.fromEntries(res.entries)[0] ?? Resource.VersionInfo.createEmpty();
  vi.setFileVersion(v[0], v[1], v[2], 0, 1033);
  vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: packager.appInfo.productName,
    ProductName: packager.appInfo.productName,
    CompanyName: packager.appInfo.companyName || 'Nuno Silva',
    LegalCopyright: packager.appInfo.copyright,
    OriginalFilename: `${packager.appInfo.productFilename}.exe`,
    InternalName: packager.appInfo.productFilename,
    FileVersion: packager.appInfo.version,
    ProductVersion: packager.appInfo.version,
  });
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exeData);
  fs.writeFileSync(exe, Buffer.from(exeData.generate()));
  console.log(`  • ícone e versão aplicados a ${path.basename(exe)}`);
};
