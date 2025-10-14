export const handler = async (event, context) => {
  const { code, state } = event.queryStringParameters;
  const params = new URLSearchParams('');
  params.append('code', code);
  params.append('state', state);
  const location = "exile-diary://auth?" + params;

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exile Diary Authentication</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background-color: #1a1a1a;
        color: #d0d0d0;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        height: 100vh;
        margin: 0;
      }
      .container {
        background-color: #2c2c2c;
        padding: 30px 40px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        max-width: 400px;
      }
      h1 {
        color: #fff;
        margin-top: 0;
      }
      a.button {
        display: inline-block;
        margin-top: 20px;
        padding: 12px 24px;
        background-color: #007bff;
        color: white;
        text-decoration: none;
        border-radius: 5px;
        font-weight: bold;
        transition: background-color 0.2s;
      }
      a.button:hover {
        background-color: #0056b3;
      }
      .hidden {
        display: none;
      }
    </style>
    <script>
      window.onload = function() {
        const redirectUrl = "${location}";
        // 1. Attempt the automatic redirect to the application.
        window.location.href = redirectUrl;

        // 2. After a delay, update the page to show the success message and a manual fallback button.
        setTimeout(function() {
          document.getElementById("message-initial").classList.add("hidden");
          const successMessage = document.getElementById("message-success");
          successMessage.classList.remove("hidden");
          
          // 3. Set the href for the fallback button.
          document.getElementById("fallback-link").href = redirectUrl;
        }, 1500);
      };
    </script>
  </head>
  <body>
    <div class="container">
      <div id="message-initial">
        <h1>Authenticating...</h1>
        <p>Returning you to the Exile Diary application.</p>
      </div>
      <div id="message-success" class="hidden">
        <h1>Authentication Successful!</h1>
        <p>You can now close this window.</p>
        <p><small>If you were not redirected automatically, click the button below.</small></p>
        <a href="#" id="fallback-link" class="button">Open Exile Diary</a>
      </div>
    </div>
  </body>
  </html>
  `;

  const response = {
      statusCode: 200,
      headers: {
          'Content-Type': 'text/html',
      },
      body: html,
  };
  return response;
};