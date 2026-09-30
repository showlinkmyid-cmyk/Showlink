(() => {
'use strict';
const T={
id:{
'sl.createTitle':'Buat Shortlink','sl.createIntro':'Buat Shortlink untuk mengarahkan user ke konten asli melalui pilihan FREE atau akses langsung dengan Payment Link.',
'sl.title':'Judul','sl.description':'Deskripsi','sl.descriptionPh':'Jelaskan isi konten...','sl.content':'Isi Konten',
'sl.contentPh':'Masukkan link atau konten yang akan dibuka...','sl.contentDetail':'URL https:// atau www. akan otomatis menjadi link yang bisa diklik.',
'sl.flowTitle':'Alur akses Shortlink','sl.flowDetail':'Sistem otomatis mengatur jumlah Task dan FINAL sesuai paket akun. User FREE melewati 3 Task, VIP 2 Task, dan PREMIUM 1 Task. Halaman Task sudah disiapkan oleh sistem.',
'sl.warningTitle':'Peringatan','sl.warning':'Periksa judul, deskripsi, dan isi konten sebelum publish. Setelah Shortlink dibagikan, data tersebut dapat dilihat oleh user.',
'sl.createBtn':'Buat Shortlink','sl.ready':'Isi data lalu publish.'
},
en:{
'sl.createTitle':'Create Shortlink','sl.createIntro':'Create a Shortlink that lets users choose FREE access or direct access through a Payment Link.',
'sl.title':'Title','sl.description':'Description','sl.descriptionPh':'Explain what the content contains...','sl.content':'Content',
'sl.contentPh':'Enter the link or content that will be opened...','sl.contentDetail':'URLs starting with https:// or www. will automatically become clickable links.',
'sl.flowTitle':'Shortlink access flow','sl.flowDetail':'The system automatically sets the number of Tasks and FINAL based on the account plan. FREE users pass 3 Tasks, VIP 2 Tasks, and PREMIUM 1 Task. Task pages are managed by the system.',
'sl.warningTitle':'Warning','sl.warning':'Check the title, description, and content before publishing. Users can see published information.',
'sl.createBtn':'Create Shortlink','sl.ready':'Fill in the details and publish.'
}};
function apply(){
 const lang=localStorage.getItem('showlink-language')==='en'?'en':'id';
 document.querySelectorAll('[data-i18n]').forEach(el=>{
   const k=el.dataset.i18n;if(T[lang][k]!==undefined)el.textContent=T[lang][k];
 });
 document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
   const k=el.dataset.i18nPlaceholder;if(T[lang][k]!==undefined)el.placeholder=T[lang][k];
 });
 document.documentElement.lang=lang;
}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-lang-option]')) setTimeout(apply,0);
});
window.addEventListener('storage',e=>{if(e.key==='showlink-language')apply();});
document.addEventListener('DOMContentLoaded',apply);
})();