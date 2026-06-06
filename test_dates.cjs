const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:5000/factory/dispatches', {
      headers: {
        // We don't have a token, but let's bypass auth locally or fetch from DB directly if API is protected
      }
    });
    console.log("Success");
  } catch(e) {
    console.log("Failed API, let's query DB directly using exact same query");
  }
}

test();
