import 'package:flutter_test/flutter_test.dart';
import 'package:google_sign_in/google_sign_in.dart';

void main() {
  test('GoogleSignIn test', () {
    final g = GoogleSignIn.instance;
    expect(g, isNotNull);
  });
}
