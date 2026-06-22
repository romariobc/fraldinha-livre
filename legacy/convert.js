const fs = require('fs');
let html = fs.readFileSync('legacy/index.html', 'utf8');

// Replacements for JSX
html = html.replace(/class=/g, 'className=');
html = html.replace(/for=/g, 'htmlFor=');
html = html.replace(/<img([^>]*[^\/])>/g, '<img$1 />');
html = html.replace(/<input([^>]*[^\/])>/g, '<input$1 />');
html = html.replace(/<br>/g, '<br />');

// Convert style="key: value" to style={{key: "value"}}
html = html.replace(/style="([^"]+)"/g, (match, p1) => {
    const rules = p1.split(';').filter(s => s.trim().length > 0);
    const styleObj = {};
    rules.forEach(rule => {
        let [key, val] = rule.split(':');
        if (!key || !val) return;
        key = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
        styleObj[key] = val.trim();
    });
    return 'style={{' + Object.entries(styleObj).map(([k, v]) => `${k}: "${v}"`).join(', ') + '}}';
});

fs.writeFileSync('legacy/index.jsx', html);
console.log('Converted HTML to JSX in legacy/index.jsx');
