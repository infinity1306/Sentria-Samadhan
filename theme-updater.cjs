const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('d:/hackathon/frontend/src');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    // Replace white glass effects with black glass effects
    content = content.replace(/border-white\/(\d+)/g, 'border-black/$1');
    content = content.replace(/bg-white\/(\d+)/g, 'bg-black/$1');
    // text-white usually means textMain in our light theme
    content = content.replace(/text-white/g, 'text-textMain');
    // Any remaining explicit dark mode backgrounds should use our new surface colors
    content = content.replace(/bg-surface\/(\d+)/g, 'bg-surface/$1');
    
    // Some icons use explicit text-white
    content = content.replace(/color="white"/g, 'color="currentColor"');
    
    fs.writeFileSync(file, content);
});
console.log('Theme updated successfully.');
