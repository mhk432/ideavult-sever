
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("ideavault");
    const ideasCollection = db.collection("ideas");

    console.log("MongoDB connected!");

    // ===================== GET ALL IDEAS =====================
    app.get("/ideas", async (req, res) => {
      try {
        const { search, category, startDate, endDate, limit } = req.query;

        let query = {};

        if (search) {
          query.title = {
            $regex: search,
            $options: "i",
          };
        }

        if (category) {
          query.category = category;
        }

        if (startDate && endDate) {
          query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          };
        }

        let cursor = ideasCollection.find(query).sort({ _id: -1 });

        if (limit) {
          cursor = cursor.limit(parseInt(limit));
        }

        const result = await cursor.toArray();
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json([]);
      }
    });

    // ===================== POST IDEA =====================
    app.post("/ideas", async (req, res) => {
      try {
        const idea = {
          ...req.body,
          comments: [],
          createdAt: new Date(),
        };

        const result = await ideasCollection.insertOne(idea);
        res.json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to create idea" });
      }
    });

    // ===================== GET SINGLE IDEA =====================
    app.get("/ideas/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await ideasCollection.findOne({
          _id: new ObjectId(id),
        });

        res.json(result);
      } catch (error) {
        res.status(500).json(null);
      }
    });

    // ===================== GET COMMENTS (FIXED - IMPORTANT) =====================
    app.get("/ideas/:id/comments", async (req, res) => {
      try {
        const { id } = req.params;

        const idea = await ideasCollection.findOne(
          { _id: new ObjectId(id) },
          { projection: { comments: 1 } }
        );

        res.json(idea?.comments || []);
      } catch (error) {
        console.error(error);
        res.status(500).json([]);
      }
    });

    // ===================== ADD COMMENT =====================
    app.post("/ideas/:id/comments", async (req, res) => {
      try {
        const { id } = req.params;
        const { text, user } = req.body;

        const newComment = {
          id: new ObjectId().toString(),
          text,
          user: {
            name: user?.name,
            image: user?.image,
            email: user?.email,
          },
          createdAt: new Date(),
        };

        await ideasCollection.updateOne(
          { _id: new ObjectId(id) },
          { $push: { comments: newComment } }
        );

        res.json(newComment);
      } catch (error) {
        res.status(500).json({ message: "Failed to add comment" });
      }
    });

    // ===================== UPDATE COMMENT =====================
    app.put("/ideas/:ideaId/comments/:commentId", async (req, res) => {
      try {
        const { ideaId, commentId } = req.params;
        const { text } = req.body;

        await ideasCollection.updateOne(
          {
            _id: new ObjectId(ideaId),
            "comments.id": commentId,
          },
          {
            $set: {
              "comments.$.text": text,
            },
          }
        );

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false });
      }
    });

    // ===================== DELETE COMMENT (ONLY ONE VERSION) =====================
    app.delete("/ideas/:ideaId/comments/:commentId", async (req, res) => {
      try {
        const { ideaId, commentId } = req.params;

        await ideasCollection.updateOne(
          { _id: new ObjectId(ideaId) },
          {
            $pull: {
              comments: { id: commentId },
            },
          }
        );

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false });
      }
    });

    // ===================== UPDATE IDEA =====================
    app.put("/ideas/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await ideasCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: req.body }
        );

        res.json(result);
      } catch (error) {
        res.status(500).json({ message: "Update failed" });
      }
    });

    // ===================== DELETE IDEA =====================
    app.delete("/ideas/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await ideasCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.json(result);
      } catch (error) {
        res.status(500).json({ message: "Delete failed" });
      }
    });

    // ===================== MY IDEAS =====================
   app.get("/my-ideas", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.json([]);
    }

    const result = await ideasCollection
      .find({  userId: userId  })
      .sort({ _id: -1 })
      .toArray();

    res.json(result);
  } catch (error) {
    res.status(500).json([]);
  }
});

    
    app.get("/my-interactions", async (req, res) => {
      try {
        const ideas = await ideasCollection
          .find({
            comments: { $exists: true, $ne: [] },
          })
          .sort({ _id: -1 })
          .toArray();

        res.json(ideas);
      } catch (error) {
        res.status(500).json([]);
      }
    });

  } catch (error) {
    console.error(error);
  }
}

run().catch(console.dir);

// ===================== ROOT =====================
app.get("/", (req, res) => {
  res.send("IdeaVault server running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});