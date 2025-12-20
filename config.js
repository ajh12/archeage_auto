export const SUPABASE_URL = "https://furdwhmgplodjkemkxkm.supabase.co"; 
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1cmR3aG1ncGxvZGprZW1reGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjkyMDAsImV4cCI6MjA4MTU0NTIwMH0.Om___1irBNCjya4slfaWqJeUVoyVCvvMaDHKwYm3yg0"; 
export const RECAPTCHA_SITE_KEY = '6LeCozEsAAAAAIcJ8W96QeQpaadZxd_YA7p3Ao4U';

export const ENABLE_SNOW = true; 
export const PAGE_SIZE = 10;
export const ADMIN_PAGE_SIZE = 10;

export const ROUTE_MAP = {
    'home': 'fme120e0f',        
    'notice': '5a105e8b',  
    'free': 'ad023482',    
    'list': 'b3a8e0e1',    
    'admin': '9f86d081',   
    'write': '11e389c9',   
    'search': '05972be4',  
    'detail': 'e29a1c3f'   
};

export const PAGE_TITLES = {
    'home': '하포카 해결소',
    'notice': '하포카 해결소 | 공지사항',
    'free': '하포카 해결소 | 자유대화방',
    'list': '하포카 해결소 | 오류해결소',
    'admin': '하포카 해결소 | 관리자',
    'write': '하포카 해결소 | 글쓰기',
    'search': '하포카 해결소 | 검색결과',
    'detail': '하포카 해결소' 
};

export const particlesConfig = {
  "particles": {
    "number": { "value": 100, "density": { "enable": true, "value_area": 800 } },
    "color": { "value": "#ffffff" },
    "shape": { "type": "circle", "stroke": { "width": 0, "color": "#000000" }, "polygon": { "nb_sides": 5 } },
    "opacity": { "value": 0.8, "random": true, "anim": { "enable": false, "speed": 1, "opacity_min": 0.1, "sync": false } },
    "size": { "value": 5, "random": true, "anim": { "enable": false, "speed": 40, "size_min": 0.1, "sync": false } },
    "line_linked": { "enable": false, "distance": 500, "color": "#ffffff", "opacity": 0.4, "width": 2 },
    "move": { "enable": true, "speed": 3, "direction": "bottom", "random": false, "straight": false, "out_mode": "out", "bounce": false, "attract": { "enable": false, "rotateX": 600, "rotateY": 1200 } }
  },
  "interactivity": {
    "detect_on": "canvas",
    "events": { "onhover": { "enable": false, "mode": "bubble" }, "onclick": { "enable": false, "mode": "repulse" }, "resize": true },
    "modes": { "grab": { "distance": 400, "line_linked": { "opacity": 0.5 } }, "bubble": { "distance": 400, "size": 4, "duration": 0.3, "opacity": 1, "speed": 3 }, "repulse": { "distance": 200, "duration": 0.4 }, "push": { "particles_nb": 4 }, "remove": { "particles_nb": 2 } }
  },
  "retina_detect": true
};
