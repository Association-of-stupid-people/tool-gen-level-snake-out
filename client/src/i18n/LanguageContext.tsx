import { createContext, useContext, useState, type ReactNode } from 'react'
import { t } from './translations'
import type { Language, TranslationKey } from './translations'

interface LanguageContextType {
    language: Language
    setLanguage: (lang: Language) => void
    t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>('EN')

    const translate = (key: TranslationKey): string => t(key, language)

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t: translate }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}
