import bcryptjs from "bcryptjs";

const generateHash = async () => {
    const salt = await bcryptjs.genSalt(10);
    // Replace 'your_password' with whatever you want your admin password to be
    const hash = await bcryptjs.hash("lalala123", salt); 
    console.log("Copy this hash to Supabase:");
    console.log(hash);
};

generateHash();