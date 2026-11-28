import 'package:material_ui/material_ui.dart';

abstract final class AppTypography {
  static const _display = 'Wix Madefor Display';
  static const _ui = 'Instrument Sans';

  static const displayLarge = TextStyle(
    fontFamily: _display,
    fontSize: 28,
    height: 34 / 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.25,
  );
  static const headlineLarge = TextStyle(
    fontFamily: _display,
    fontSize: 28,
    height: 34 / 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.25,
  );
  static const headlineMedium = TextStyle(
    fontFamily: _display,
    fontSize: 22,
    height: 28 / 22,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.1,
  );
  static const headlineSmall = TextStyle(
    fontFamily: _display,
    fontSize: 18,
    height: 24 / 18,
    fontWeight: FontWeight.w600,
  );
  static const titleLarge = TextStyle(
    fontFamily: _ui,
    fontSize: 18,
    height: 24 / 18,
    fontWeight: FontWeight.w600,
  );
  static const titleMedium = TextStyle(
    fontFamily: _ui,
    fontSize: 16,
    height: 22 / 16,
    fontWeight: FontWeight.w600,
  );
  static const titleSmall = TextStyle(
    fontFamily: _ui,
    fontSize: 14,
    height: 20 / 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
  );
  static const bodyLarge = TextStyle(
    fontFamily: _ui,
    fontSize: 16,
    height: 24 / 16,
  );
  static const bodyMedium = TextStyle(
    fontFamily: _ui,
    fontSize: 14,
    height: 20 / 14,
    letterSpacing: 0.1,
  );
  static const bodySmall = TextStyle(
    fontFamily: _ui,
    fontSize: 12,
    height: 16 / 12,
    letterSpacing: 0.2,
  );
  static const labelLarge = TextStyle(
    fontFamily: _ui,
    fontSize: 14,
    height: 20 / 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
  );

  static TextTheme textTheme(TextTheme base) => base.copyWith(
    displayLarge: displayLarge,
    headlineLarge: headlineLarge,
    headlineMedium: headlineMedium,
    headlineSmall: headlineSmall,
    titleLarge: titleLarge,
    titleMedium: titleMedium,
    titleSmall: titleSmall,
    bodyLarge: bodyLarge,
    bodyMedium: bodyMedium,
    bodySmall: bodySmall,
    labelLarge: labelLarge,
  );
}
