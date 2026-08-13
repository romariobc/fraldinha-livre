class ChatMessage {
  final String role; // 'user' | 'assistant'
  final String? content;
  final String? imageUrl; // Base64 data URI

  ChatMessage({
    required this.role,
    this.content,
    this.imageUrl,
  });

  Map<String, dynamic> toJson() {
    return {
      'role': role,
      if (content != null) 'content': content,
      if (imageUrl != null) 'imageUrl': imageUrl,
    };
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      role: json['role'] as String,
      content: json['content'] as String?,
      imageUrl: json['imageUrl'] as String?,
    );
  }
}
