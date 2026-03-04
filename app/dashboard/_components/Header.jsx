"use client";
import { SignInButton, UserButton, SignedOut, SignedIn } from "@clerk/nextjs";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Bot } from "lucide-react";

function Header() {
  const path = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const controlNavbar = useCallback(() => {
    if (typeof window !== "undefined") {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    }
  }, [lastScrollY]);

  useEffect(() => {
    window.addEventListener("scroll", controlNavbar);
    return () => window.removeEventListener("scroll", controlNavbar);
  }, [controlNavbar]);

  const toggleMobileMenu = () => {
    const nextState = !isMobileMenuOpen;
    setIsMobileMenuOpen(nextState);

    document.body.style.overflow = nextState ? "hidden" : "unset";
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    document.body.style.overflow = "unset";
  };

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/how-it-works", label: "How it works" },
    { href: "/about-us", label: "About us" },
  ];

 return (
    <>
      <header
        className={`
          fixed top-0 left-0 right-0 z-50
          flex items-center justify-between
          p-4 sm:p-5
          bg-white/90 backdrop-blur-md
          shadow-md
          transition-transform duration-300 ease-in-out
          ${isVisible ? "translate-y-0" : "-translate-y-full"}
        `}
      >
        {/* Logo */}
        <Link
        href="/"
        aria-label="Skill-Up AI Home"
        onClick={closeMobileMenu}
        className="flex items-center gap-2"
        >
          <Bot className="text-indigo-600" size={28} />
          <span className="text-xl sm:text-2xl font-bold text-indigo-600">SkillUP-AI</span>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex gap-4 lg:gap-6" aria-label="Main Navigation">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              path={path}
              href={item.href}
              label={item.label}
              onClick={closeMobileMenu}
            />
          ))}
        </nav>

        {/* AUTH + MOBILE MENU */}
        <div className="flex items-center gap-3">
          {/* DESKTOP AUTH */}
          <div className="hidden md:block">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    userButtonAvatarBox: "w-10 h-10",
                  },
                }}
              />
            </SignedIn>
          </div>

          {/* MOBILE AVATAR */}
          <div className="md:hidden">
            <button className="avatar">V</button>
          </div>

          {/* MOBILE MENU BUTTON */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden text-gray-600 hover:text-indigo-600 transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* MOBILE MENU OVERLAY */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-white z-40 md:hidden pt-20 px-6"
          role="dialog"
          aria-modal="true"
        >
          <nav className="space-y-6">
            {navItems.map((item) => (
              <NavItem
                key={item.href}
                path={path}
                href={item.href}
                label={item.label}
                mobile
                onClick={closeMobileMenu}
              />
            ))}

            {/* MOBILE AUTH */}
            <div className="pt-6 border-t">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md">
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>

              <SignedIn>
                <div className="flex justify-center mt-4">
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: { userButtonAvatarBox: "w-12 h-12" },
                    }}
                  />
                </div>
              </SignedIn>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

/* FIXED NavItem — NO <a> TAG — Only Link */
function NavItem({ path, href, label, mobile, onClick }) {
  const isActive = path === href;

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`
        block transition-all duration-300 cursor-pointer rounded-lg
        ${mobile ? "w-full text-lg py-3 text-center" : "px-3 py-2"}
        ${isActive
          ? "text-indigo-600 font-bold bg-indigo-100 nav-link active"
          : "text-gray-700 hover:text-indigo-600 nav-link"}
      `}
    >
      {isActive ? <span className="nav-pill">{label}</span> : label}
    </Link>
  );
}
export default Header;