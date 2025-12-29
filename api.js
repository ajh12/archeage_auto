var dbClient = null;
var clientIP = "1.2.3.4";

function initSupabase(authCallback) {
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

function getDbClient() { return dbClient; }

async function fetchClientIP() {
    try {
        const response = await fetch('https://api64.ipify.org?format=json');
        const data = await response.json();
        if(data && data.ip) clientIP = data.ip;
    } catch (e) {
        console.error("IP fetch failed", e);
    }
    return clientIP;
}

function getClientIP() { return clientIP; }

async function verifyCaptcha(token) {
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

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Captcha verification failed:', errorText);
            return false;
        }

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Captcha error:', error);
        return false;
    }
}

async function recordVisit() {
    const dbClient = getDbClient();
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

async function fetchVersion() {
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

async function fetchTopNotice() {
    if (typeof TOP_NOTICE === 'undefined' || !TOP_NOTICE.enabled || !TOP_NOTICE.useGithub || !TOP_NOTICE.githubUrl) {
        return null;
    }
    try {
        const r = await fetch(TOP_NOTICE.githubUrl + '?t=' + Date.now());
        if (!r.ok) return null;
        const text = await r.text();
        return text.trim();
    } catch (e) {
        return null;
    }
}

async function uploadImage(file) {
    if (!dbClient) return null;
    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2)}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
    
    try {
        const { data, error } = await dbClient.storage
            .from('images')
            .upload(fileName, file);

        if (error) throw error;
        
        const { data: publicData } = dbClient.storage
            .from('images')
            .getPublicUrl(fileName);
            
        return publicData.publicUrl;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}
