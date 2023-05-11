export const handler = async (event, context) => {
  /*
   * Generate HTTP redirect response with 302 status code and Location header.
   */
  const { code, state } = event.queryStringParameters;
  const params = new URLSearchParams('');
  params.append('code', code);
  params.append('state', state);
  const location = "exile-diary://auth?" + params;
  const response = {
      statusCode: 302,
      headers: {
          location: location
      },
  };
  return response;
};