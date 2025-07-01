import bcrypt from 'bcrypt';

async function hashPassword() {
  const password = 'daniel123';
  const saltRounds = 10;
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Password hash for "daniel123":');
    console.log(hash);
  } catch (error) {
    console.error('Error hashing password:', error);
  }
}

hashPassword();