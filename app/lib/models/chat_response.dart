class ChatResponse {
  final String type; // 'text' | 'action'
  final String? content; // content if type is 'text'
  final String? productId; // if type is 'action'
  final int? quantity; // if type is 'action'
  final String? paymentMethod; // if type is 'action'
  final Map<String, dynamic>? address; // if type is 'action'

  ChatResponse({
    required this.type,
    this.content,
    this.productId,
    this.quantity,
    this.paymentMethod,
    this.address,
  });

  factory ChatResponse.fromJson(Map<String, dynamic> json) {
    return ChatResponse(
      type: json['type'] as String? ?? 'text',
      content: json['content'] as String?,
      productId: json['productId'] as String?,
      quantity: json['quantity'] as int?,
      paymentMethod: json['paymentMethod'] as String?,
      address: json['address'] as Map<String, dynamic>?,
    );
  }
}
