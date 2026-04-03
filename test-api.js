import fetch from "node-fetch";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function test() {
  try {
    const response = await fetch("http://localhost:3000/api/ai/generate-content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer test-token`, // Will fail auth but should not crash
      },
      body: JSON.stringify({
        type: "summary",
        context: {
          jobTitle: "Software Engineer",
          yearsExp: "5",
          skills: "React, Node.js",
          industry: "Tech",
          targetRole: "Senior Engineer",
          __preview: "true",
        },
      }),
    });

    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", data);
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
