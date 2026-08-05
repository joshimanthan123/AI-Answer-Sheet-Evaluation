class ApiResponse {
  constructor(statusCode, message = "Success", data = null, meta = null) {
    this.statusCode = statusCode;
    this.success = true;
    this.message = message;
    this.data = data;
    this.meta = meta; // Custom meta object (e.g. for pagination)
  }
}

export default ApiResponse;
