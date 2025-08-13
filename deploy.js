const fs = require('fs');
const path = require('path');

// Build directory path
const buildDir = path.join(__dirname, 'build');

// Create build directory if it doesn't exist
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
}

// List of files to copy
const filesToCopy = [
    'index.html',
    'add-material.html',
    'product-price.html',
    'all-materials.html',
    'all-product-prices.html', // New file added
    'firebase-config.js',
    'add-material.js',
    'product-price.js',
    'all-materials.js',
    'all-product-prices.js', // New file added
    'styles.css'
];

// Copy files to build directory
filesToCopy.forEach(file => {
    try {
        fs.copyFileSync(
            path.join(__dirname, file),
            path.join(buildDir, file)
        );
        console.log(`✓ Copied ${file}`);
    } catch (err) {
        console.error(`× Error copying ${file}:`, err.message);
    }
});

// Create .htaccess for Apache servers
const htaccess = `
# Enable CORS
Header set Access-Control-Allow-Origin "*"

# Ensure correct MIME types
AddType application/javascript .js
AddType text/css .css

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/css application/javascript
</IfModule>

# Set caching
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 week"
    ExpiresByType application/javascript "access plus 1 week"
    ExpiresByType text/html "access plus 0 seconds"
</IfModule>

# Handle single page app routing
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.html [L,QSA]
`;

fs.writeFileSync(path.join(buildDir, '.htaccess'), htaccess.trim());
console.log('✓ Created .htaccess file');

console.log('\n✨ Build completed successfully! Your app is ready for deployment.');
console.log('\nTo deploy:');
console.log('1. Upload all files from the "build" folder to your web hosting');
console.log('2. Ensure your hosting has HTTPS enabled');
console.log('3. Point your domain to the uploaded files\n');
