import AppIntents
internal import ExpoAppIntents

// Lo que Siri puede pedirle a la casa. Las bombillas y la tele las maneja la app (src/siri.tsx), así que
// cada acción la abre un momento y le deja el encargo.

struct PonerModoIntent: AppIntent {
  static let title: LocalizedStringResource = "Poner un modo"
  static let description = IntentDescription("Pone un modo de MarsianApp: luces, tele y Ambilight a la vez.")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Modo", requestValueDialog: "¿Qué modo pongo?")
  var modo: ModoEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Poner \(\.$modo)")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await AppIntentDispatcher.shared.dispatch(name: "ponerModo", params: ["modoId": .string(modo.id)])
    return .result(dialog: "Pongo \(modo.name)")
  }
}

struct QuitarModoIntent: AppIntent {
  static let title: LocalizedStringResource = "Quitar un modo"
  static let description = IntentDescription("Quita un modo y deja las luces y el Ambilight como estaban.")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Modo", requestValueDialog: "¿Qué modo quito?")
  var modo: ModoEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Quitar \(\.$modo)")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await AppIntentDispatcher.shared.dispatch(name: "quitarModo", params: ["modoId": .string(modo.id)])
    return .result(dialog: "Quito \(modo.name)")
  }
}

struct EncenderLucesIntent: AppIntent {
  static let title: LocalizedStringResource = "Encender las luces"
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await AppIntentDispatcher.shared.dispatch(name: "luces", params: ["on": .bool(true)])
    return .result(dialog: "Enciendo las luces")
  }
}

struct ApagarLucesIntent: AppIntent {
  static let title: LocalizedStringResource = "Apagar las luces"
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await AppIntentDispatcher.shared.dispatch(name: "luces", params: ["on": .bool(false)])
    return .result(dialog: "Apago las luces")
  }
}

// Apple obliga a que cada frase lleve el nombre de la app; «Marsiana» también vale como nombre (app.json).
struct CasaShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: PonerModoIntent(),
      phrases: [
        "Pon \(\.$modo) en \(.applicationName)",
        "Pon el modo \(\.$modo) en \(.applicationName)",
        "Modo \(\.$modo) en \(.applicationName)",
        "\(.applicationName) \(\.$modo)",
        "Pon un modo en \(.applicationName)",
      ],
      shortTitle: "Poner modo",
      systemImageName: "sparkles"
    )
    AppShortcut(
      intent: QuitarModoIntent(),
      phrases: [
        "Quita \(\.$modo) en \(.applicationName)",
        "Quita el modo \(\.$modo) en \(.applicationName)",
        "Quita un modo en \(.applicationName)",
      ],
      shortTitle: "Quitar modo",
      systemImageName: "xmark.circle"
    )
    AppShortcut(
      intent: EncenderLucesIntent(),
      phrases: ["Enciende las luces en \(.applicationName)", "Enciende \(.applicationName)"],
      shortTitle: "Encender luces",
      systemImageName: "lightbulb.fill"
    )
    AppShortcut(
      intent: ApagarLucesIntent(),
      phrases: ["Apaga las luces en \(.applicationName)", "Apaga \(.applicationName)"],
      shortTitle: "Apagar luces",
      systemImageName: "lightbulb.slash"
    )
  }
}
