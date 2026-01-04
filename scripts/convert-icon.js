// Script to convert Logo.png to icons for all platforms
const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../assets/icons');
const inputPath = path.join(iconsDir, 'Logo.png');

console.log('🎨 EVOS Browser Icon Converter');
console.log('================================\n');

// Check if input file exists
if (!fs.existsSync(inputPath)) {
  console.error('❌ Input file not found:', inputPath);
  console.log('   Please make sure Logo.png exists in assets/icons/');
  process.exit(1);
}

console.log('📁 Source:', inputPath);
console.log('');

// 1. Copy to icon.png (for Electron runtime on all platforms)
const pngOutput = path.join(iconsDir, 'icon.png');
fs.copyFileSync(inputPath, pngOutput);
console.log('✅ Created icon.png (runtime icon for all platforms)');

// 2. Create icon.ico for Windows
const icoOutput = path.join(iconsDir, 'icon.ico');
const convert = typeof pngToIco === 'function' ? pngToIco : pngToIco.convert;

convert(inputPath)
  .then(buf => {
    fs.writeFileSync(icoOutput, buf);
    console.log('✅ Created icon.ico (Windows taskbar/exe icon)');
    
    console.log('\n================================');
    console.log('📋 Platform Support:');
    console.log('   • Windows: ✅ icon.ico ready');
    console.log('   • Linux:   ✅ icon.png ready');
    console.log('   • macOS:   ⚠️  Need to create icon.icns manually');
    console.log('');
    console.log('💡 For macOS, use one of these methods:');
    console.log('   1. Online: https://cloudconvert.com/png-to-icns');
    console.log('   2. On Mac: iconutil -c icns icon.iconset');
    console.log('   3. Tool:   npm install -g png2icons && png2icons Logo.png icon -icns');
    console.log('');
    console.log('📂 Output directory:', iconsDir);
  })
  .catch(err => {
    console.error('❌ Error converting to ICO:', err);
  });
