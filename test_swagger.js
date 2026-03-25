import axios from 'axios';

const SWAGGER_URL = process.env.SWAGGER_URL || 'https://erp.aaro.com.tr/swagger/docs/v1';

axios.get(SWAGGER_URL).then(res => {
  const paths = Object.keys(res.data.paths);
  
  console.log('--- CARI/{id} benzer yollar ---');
  paths.filter(p => p.toLowerCase().includes('/api/cari') && p.includes('{')).forEach(p => console.log(p));

  console.log('\n--- STOKHAREKETLERI benzer yollar ---');
  paths.filter(p => p.toLowerCase().includes('/api/stokhareketleri')).forEach(p => console.log(p));
  
  // Exact match check
  const check = ['/api/Cari/{id}', '/api/StokHareketleri/Pivot'];
  console.log('\n--- Exact match kontrolü ---');
  for (const c of check) {
    const found = paths.includes(c);
    console.log(`${found ? '✅' : '❌'} "${c}" → ${found ? 'BULUNDU' : 'BULUNAMADI'}`);
  }
}).catch(console.error);
