import bcryptjs from "bcryptjs";

const generateHash = async () => {
    const rawPassword = process.argv[2];

    if (!rawPassword) {
        console.error("Usage: node hash.js <plain_password>");
        process.exit(1);
    }

    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(rawPassword, salt);

    console.log("Copy this hash to Supabase:");
    console.log(hash);
    console.log("\nExample SQL:");
    console.log(
        `INSERT INTO users (email, password_hash) VALUES ('owner@wynfitness.com', '${hash}');`
    );
};

generateHash();