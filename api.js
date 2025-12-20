import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let dbClient = null;
let clientIP = "1.2.3.4";

export function initSupabase(authCallback) {
    try {
        if(SUPABASE_URL && SUPABASE_ANON_KEY) {
            const { createClient } = window.supabase; 
            dbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            
            if (authCallback) {
                dbClient.auth.onAuthStateChange(authCallback);
            }
            return dbClient;
        }
    } catch(e) {
        console.error("Supabase init error:", e);
    }
    return null;
}

export function getDbClient() { return dbClient; }

export async function fetchClientIP() {
    try {
        const response = await fetch('https://api64.ipify.org?format=json');
        const data = await response.json();
        if(data && data.ip) clientIP = data.ip;
    } catch (e) {
        console.error("IP fetch failed", e);
    }
    return clientIP;
}

export function getClientIP() { return clientIP; }

export async function verifyCaptcha(token) {
    if (!dbClient) return false;
    
    try {
        const functionUrl = `${SUPABASE_URL}/functions/v1/verify-captcha`;
        
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ token })
        });

        if (!response.ok) return false;
        const data = await response.json();

        if (!data || !data.success) return false;
        if (data.score !== undefined && data.score < 0.5) return false;

        return true;

    } catch (e) {
        return false;
    }
}

export async function recordVisit() {
    if(!dbClient) return;
    
    const today = new Date().toISOString().split('T')[0];
    const lastVisitKey = 'aa_last_visit_date';
    const lastVisit = localStorage.getItem(lastVisitKey);
    
    if(lastVisit !== today) {
        localStorage.setItem(lastVisitKey, today);
        try {
            const { data, error } = await dbClient.from('daily_stats').select('*').eq('date', today).single();
            
            if(error && error.code === 'PGRST116') {
                await dbClient.from('daily_stats').insert([{ date: today, visitors: 1 }]);
            } else if(data) {
                await dbClient.from('daily_stats').update({ visitors: data.visitors + 1 }).eq('date', today);
            }
        } catch(e) {}
    }
}

export async function fetchVersion() {
    try {
        const r = await fetch('https://raw.githubusercontent.com/Pretsg/Archeage_auto/main/version.txt');
        const t = await r.text();
        let v = t.trim().split(/\s+/)[0]; 
        if(v && !v.toLowerCase().startsWith('v')) v = 'v' + v;
        return v || 'v0.1';
    } catch(e) {
        return null;
    }
}

export async function uploadImage(file) {
    if (!dbClient) return null;
    const fileName = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${(file.name || 'image.png').split('.').pop()}`;
    const { data, error } = await dbClient.storage.from('images').upload(fileName, file);
    if (error) throw error;
    const { data: { publicUrl } } = dbClient.storage.from('images').getPublicUrl(fileName);
    return publicUrl;
}
