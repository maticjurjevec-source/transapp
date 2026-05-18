// Node.js skripta za odstranitev duplikatov posljiViber funkcije
// Uporaba: node ocisti-duplikate.js

const fs = require('fs');
const path = require('path');

const srcFile = path.join('src', 'DispecarPlascaV3.jsx');
const backupFile = path.join('src', 'DispecarPlascaV3.BACKUP2.jsx');

if (!fs.existsSync(srcFile)) {
    console.error(`❌ Napaka: ${srcFile} ne obstaja!`);
    console.error('   Skripto poženi iz korenske mape projekta (C:\\Users\\matic\\transapp\\)');
    process.exit(1);
}

// Naredi varnostno kopijo
console.log(`📦 Naredi varnostno kopijo: ${backupFile}`);
fs.copyFileSync(srcFile, backupFile);

// Preberi datoteko
let content = fs.readFileSync(srcFile, 'utf8');
const originalLength = content.length;
console.log(`📄 Prebrana datoteka: ${originalLength} znakov`);

// Najdi vse pozicije, kjer se začne "const posljiViber"
const searchStr = 'const posljiViber';
const positions = [];
let pos = 0;
while ((pos = content.indexOf(searchStr, pos)) !== -1) {
    positions.push(pos);
    pos += searchStr.length;
}

console.log(`🔍 Najdenih pozicij 'const posljiViber': ${positions.length}`);

if (positions.length <= 1) {
    console.log('✅ Ni duplikatov za odstraniti');
    process.exit(0);
}

// Za vsako pozicijo (razen prve) najdi začetek bloka (komentar pred njo) in konec (matching closing })
// in odstrani ta blok.
// Začetek bloka: vrstica s "// Pošlji nalog vozniku preko Viberja" pred njo
// Konec bloka: zadnji "};" pred naslednjo deklaracijo

function findBlockBounds(content, declStart) {
    // Najdi začetek vrstice s komentarjem pred deklaracijo
    // Idemo nazaj od declStart in iščemo '\n  // Pošlji'
    let blockStart = declStart;
    
    // Pojdi nazaj do začetka vrstice
    while (blockStart > 0 && content[blockStart - 1] !== '\n') {
        blockStart--;
    }
    
    // Preveri, če je vrstica pred to komentar "// Pošlji nalog vozniku..."
    if (blockStart >= 2) {
        // Najdi prejšnjo vrstico
        let prevLineEnd = blockStart - 1; // \n
        let prevLineStart = prevLineEnd;
        while (prevLineStart > 0 && content[prevLineStart - 1] !== '\n') {
            prevLineStart--;
        }
        const prevLine = content.substring(prevLineStart, prevLineEnd);
        if (prevLine.includes('// Pošlji nalog vozniku preko Viberja')) {
            blockStart = prevLineStart;
        }
    }
    
    // Najdi konec bloka — to je "};" + newline na začetku vrstice
    // Začnemo iskati od declStart naprej za "{"
    let braceDepth = 0;
    let i = declStart;
    let foundFirstBrace = false;
    
    // Najprej najdi prvi "{"
    while (i < content.length) {
        if (content[i] === '{') {
            braceDepth++;
            foundFirstBrace = true;
            i++;
            break;
        }
        i++;
    }
    
    // Sledi oklepajem dokler ne pride do depth 0
    while (i < content.length && braceDepth > 0) {
        const ch = content[i];
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
        // Preskoči nize in template literali
        else if (ch === '"' || ch === "'" || ch === '`') {
            const quote = ch;
            i++;
            while (i < content.length && content[i] !== quote) {
                if (content[i] === '\\') i++; // preskoči escape
                i++;
            }
        }
        i++;
    }
    
    // i je zdaj za zadnjim "}". Pričakujemo ";" in nato newline
    if (i < content.length && content[i] === ';') {
        i++; // preskoči ";"
    }
    // Pojdi do konca vrstice
    while (i < content.length && content[i] !== '\n') {
        i++;
    }
    if (i < content.length && content[i] === '\n') {
        i++; // vključi newline
    }
    
    return { start: blockStart, end: i };
}

// Najdi meje vsakega bloka
const blocks = positions.map(p => findBlockBounds(content, p));

console.log(`📦 Identificiranih ${blocks.length} blokov:`);
blocks.forEach((b, i) => {
    const length = b.end - b.start;
    const preview = content.substring(b.start, Math.min(b.start + 60, b.end)).replace(/\n/g, '\\n');
    console.log(`   #${i + 1}: pozicija ${b.start}-${b.end} (${length} znakov) | ${preview}...`);
});

// Odstrani vse razen prvega (od zadaj naprej)
console.log(`\n🗑️  Odstranjujem ${blocks.length - 1} duplikatov (od zadaj naprej)...`);
for (let i = blocks.length - 1; i > 0; i--) {
    const b = blocks[i];
    content = content.substring(0, b.start) + content.substring(b.end);
}

// Zapiši nazaj
fs.writeFileSync(srcFile, content, 'utf8');

// Preveri
const newContent = fs.readFileSync(srcFile, 'utf8');
const newCount = (newContent.match(/const posljiViber/g) || []).length;

console.log('\n✅ KONČANO!');
console.log(`   Odstranjenih duplikatov: ${blocks.length - 1}`);
console.log(`   Preostalih deklaracij 'const posljiViber': ${newCount}`);
console.log(`   Velikost datoteke: ${originalLength} → ${newContent.length} znakov`);
console.log(`\n📦 Varnostna kopija je v: ${backupFile}`);
console.log(`   Če gre kaj narobe, jo lahko obnoviš z:`);
console.log(`   copy ${backupFile} ${srcFile}`);
