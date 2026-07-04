export class ApiResponse {
  constructor(data = null, message = 'Success') {
    this.success = true;
    this.data = data;
    this.message = message;
  }
}

export function sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json(new ApiResponse(data, message));
}

export default ApiResponse;
