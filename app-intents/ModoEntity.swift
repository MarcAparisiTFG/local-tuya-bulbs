import AppIntents
internal import ExpoAppIntents
import Foundation

// Los modos que Siri conoce. La lista la publica la app (src/siri.tsx) cada vez que cambian.

private func plain(_ value: String) -> String {
  value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "es_ES"))
    .trimmingCharacters(in: .whitespacesAndNewlines)
}

struct ModoEntity: AppEntity {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Modo"
  static let defaultQuery = ModoQuery()

  var id: String
  @Property(title: "Nombre")
  var name: String
  var synonyms: [String]

  var displayRepresentation: DisplayRepresentation {
    if #available(iOS 17.0, *) {
      return DisplayRepresentation(title: "\(name)", synonyms: synonyms.map { LocalizedStringResource(stringLiteral: $0) })
    }
    return DisplayRepresentation(title: "\(name)")
  }

  init(record: AppIntentEntityRecord) {
    id = record.id
    synonyms = record.synonyms
    name = record.title
  }

  /// «la chimenea», «modo chimenea» o «chimenea» valen igual.
  func matches(_ text: String) -> Bool {
    let said = plain(text)
    guard !said.isEmpty else { return false }
    return ([id, name] + synonyms).map(plain).contains { said == $0 || said.contains($0) || $0.contains(said) }
  }
}

struct ModoQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [ModoEntity] {
    try await AppIntentEntityStore.shared.entities(ofKind: "modo", matching: identifiers).map(ModoEntity.init(record:))
  }

  func suggestedEntities() async throws -> [ModoEntity] {
    try await AppIntentEntityStore.shared.entities(ofKind: "modo").map(ModoEntity.init(record:))
  }

  func entities(matching string: String) async throws -> [ModoEntity] {
    try await suggestedEntities().filter { $0.matches(string) }
  }
}
