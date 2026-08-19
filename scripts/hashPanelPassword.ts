// =====================================
// MODULE: Hash Panel Password
// Purpose: Panel sifresini bcrypt ile hashler - cikan degeri PANEL_PASSWORD_HASH'e yapistir
// Dependencies: bcryptjs
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

async function main(): Promise<void> {
  const password = process.argv[2];
  if (!password) {
    console.error('Kullanim: npm run panel:hash-password -- "<sifre>"');
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  console.log('PANEL_PASSWORD_HASH icin bu degeri .env dosyasina yapistir:');
  console.log(hash);
}

main();
