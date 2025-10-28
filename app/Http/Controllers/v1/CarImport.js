const fs = require("fs");
const path = require("path");

const db = require("../../../Models/index");
const Make = db.Make;

async function importCars() {
  try {
    const filePath = path.join(__dirname, "./makes.csv");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const lines = fileContent.split("\n");

    const carsData = [];

    // Skip header (line 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const [make, model] = line.split(",");
        if (make && model) {
          carsData.push({
            make: make.trim(),
            model: model.trim(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    console.log(`📊 Importing ${carsData.length} cars...`);

    // Insert in batches
    const batchSize = 500;
    for (let i = 0; i < carsData.length; i += batchSize) {
      const batch = carsData.slice(i, i + batchSize);
      await Make.bulkCreate(batch, { ignoreDuplicates: true });
      console.log(
        `✅ Batch ${Math.ceil((i + batchSize) / batchSize)} inserted`
      );
    }

    console.log("✅ All cars imported successfully!");

    // Show summary
    const summary = await Make.sequelize.query(
      `SELECT make, COUNT(DISTINCT model) as modelCount 
       FROM "Makes" 
       GROUP BY make 
       ORDER BY modelCount DESC LIMIT 10`
    );

    console.log("\n📈 Top 10 Makes by Model Count:");
    summary[0].forEach((item, index) => {
      console.log(`${index + 1}. ${item.make}: ${item.modelCount} models`);
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

importCars();
