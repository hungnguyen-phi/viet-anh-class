import {kieuDonVi} from '../lib/don-vi.ts';
const ca=[['ngày','luot'],['buổi','luot'],['tiết','luot'],['lần','luot'],
          ['giờ','luong'],['bài','luong'],['trang','luong'],['lead','luong'],['phút','luong'],
          ['điểm','do'],['kg','do'],['cm','do'],['%','do'],
          ['',       'luong'],['thứ lạ hoắc','luong'],['NGÀY','luot'],['Điểm','do']];
let dat=0;
for(const [u,mong] of ca){const r=kieuDonVi(u);const ok=r===mong;dat+=ok?1:0;
  console.log(`${ok?'OK  ':'SAI '} "${u}" → ${r}${ok?'':' (mong '+mong+')'}`);}
console.log(`\n${dat}/${ca.length} đạt.`); process.exit(dat===ca.length?0:1);
