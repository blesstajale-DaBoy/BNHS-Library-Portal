import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  UserCheck,
  Power,
  ShieldCheck,
  LogIn,
  ChevronRight,
} from 'lucide-react';
import {
  LibraryUser,
  UserRole,
  USER_ROLE_OPTIONS,
  normalizeUserRole,
} from '../types.ts';
import { INITIAL_USERS } from '../data/bnhsInitialData.ts';

interface FluorescentBulbLoginModalProps {
  isOpen: boolean;
  users: LibraryUser[];
  initialRole?: UserRole;
  onClose: () => void;
  onGooglePopupSignIn?: () => Promise<boolean>;
  onSelectAccount: (account: {
    id?: number;
    uid?: string;
    fullName: string;
    email: string;
    role: UserRole;
    idNumber: string;
    gradeOrDepartment: string;
  }) => Promise<void>;
}

export const FluorescentBulbLoginModal: React.FC<
  FluorescentBulbLoginModalProps
> = ({
  isOpen,
  users,
  initialRole = 'Administrator',
  onClose,
  onSelectAccount,
}) => {
  const [isBulbOn, setIsBulbOn] = useState(false);
  const [ignitionKey, setIgnitionKey] = useState(0);
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    normalizeUserRole(initialRole)
  );
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset lamp to OFF when modal opens so the interactive click-to-light animation plays fresh
  useEffect(() => {
    if (isOpen) {
      setIsBulbOn(false);
      setMemberSearch('');
      setSelectedRole(normalizeUserRole(initialRole));
    }
  }, [isOpen, initialRole]);

  const combinedUsers = useMemo(() => {
    const source = users.length > 0 ? users : INITIAL_USERS;
    return source.map((u) => ({
      ...u,
      role: normalizeUserRole(u.role),
    }));
  }, [users]);

  const roleMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return combinedUsers.filter((u) => {
      if (u.role !== selectedRole) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.idNumber.toLowerCase().includes(q) ||
        u.gradeOrDepartment.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [combinedUsers, selectedRole, memberSearch]);

  // Keep selectedMemberId synced to the first available member whenever role changes
  useEffect(() => {
    if (roleMembers.length > 0) {
      const stillPresent = roleMembers.some((m) => m.id === selectedMemberId);
      if (!stillPresent) {
        setSelectedMemberId(roleMembers[0].id);
      }
    } else {
      setSelectedMemberId(null);
    }
  }, [roleMembers, selectedMemberId]);

  if (!isOpen) return null;

  const selectedMember =
    roleMembers.find((m) => m.id === selectedMemberId) ||
    roleMembers[0] ||
    null;

  const handleToggleBulb = () => {
    setIsBulbOn((prev) => {
      const next = !prev;
      if (next) {
        setIgnitionKey((k) => k + 1);
      }
      return next;
    });
  };

  const handleLoginMember = async (member: LibraryUser) => {
    setSubmitting(true);
    try {
      await onSelectAccount({
        id: member.id,
        uid: member.uid,
        fullName: member.fullName,
        email: member.email,
        role: normalizeUserRole(member.role),
        idNumber: member.idNumber,
        gradeOrDepartment: member.gradeOrDepartment,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    await handleLoginMember(selectedMember);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 transition-colors duration-500 overflow-y-auto ${
        isBulbOn ? 'bg-[#120307]/85 backdrop-blur-sm' : 'bg-[#090204]/95'
      }`}
    >
      <div
        className={`relative w-full max-w-xl rounded-2xl border overflow-hidden shadow-2xl transition-colors duration-500 my-auto ${
          isBulbOn
            ? 'bg-[#2A0811] border-[#D4AF37]/60'
            : 'bg-[#140408] border-white/15'
        }`}
      >
        {/* Ambient Fluorescent Overhead Glow Beam when LIT */}
        {isBulbOn && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-14 h-56 opacity-90"
            style={{
              background:
                'radial-gradient(ellipse 75% 65% at 50% 0%, rgba(224, 248, 255, 0.28) 0%, rgba(212, 175, 55, 0.12) 45%, transparent 80%)',
            }}
          />
        )}

        {/* Top Bar with Close Button */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#D4AF37]">
            <span>BNHS Library Portal Sign-In</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Login Modal"
            className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ================================================================
            INTERACTIVE FLUORESCENT BULB FIXTURE
           ================================================================ */}
        <div className="relative z-10 px-6 pt-2 pb-5 flex flex-col items-center">
          {/* Interactive Clickable Fluorescent Tube Housing */}
          <button
            type="button"
            onClick={handleToggleBulb}
            aria-pressed={isBulbOn}
            className="group relative w-full max-w-md focus:outline-none cursor-pointer select-none"
          >
            {/* Ceiling Ballast Bracket */}
            <div className="mx-auto w-56 h-3 rounded-t-md bg-gradient-to-b from-neutral-500 to-neutral-700 border-x border-t border-neutral-400/50 shadow-md" />

            {/* Fluorescent Tube Assembly */}
            <div className="relative flex items-center justify-center">
              {/* Left Metallic Socket Cap */}
              <div className="h-8 w-5 rounded-l-md bg-gradient-to-b from-neutral-300 via-neutral-500 to-neutral-700 border border-neutral-400/60 shadow-inner shrink-0 flex flex-col items-center justify-center gap-1">
                <span className="h-1 w-2 rounded-full bg-neutral-800/70" />
                <span className="h-1 w-2 rounded-full bg-neutral-800/70" />
              </div>

              {/* Glass Fluorescent Bulb Tube */}
              <div
                key={ignitionKey}
                className={`relative h-8 flex-1 border-y transition-all duration-300 flex items-center justify-center overflow-hidden ${
                  isBulbOn
                    ? 'fluorescent-tube-lit bg-gradient-to-b from-[#FFFFFF] via-[#E8FAFF] to-[#CCF4FF] border-[#E0F7FF] shadow-[0_0_32px_rgba(215,246,255,0.95),0_0_64px_rgba(212,175,55,0.45)]'
                    : 'bg-gradient-to-b from-neutral-700/70 via-neutral-800/90 to-neutral-900/95 border-neutral-600/60 group-hover:border-[#D4AF37]/70'
                }`}
              >
                {/* Internal Glass Specular Highlight */}
                <div
                  className={`absolute inset-x-3 top-1 h-1.5 rounded-full ${
                    isBulbOn ? 'bg-white/95' : 'bg-white/10'
                  }`}
                />
                {/* Filament Glow Core */}
                <span
                  className={`relative z-10 text-[10px] font-mono font-bold tracking-widest uppercase transition-colors ${
                    isBulbOn
                      ? 'text-[#3A0A14]/70'
                      : 'text-white/55 group-hover:text-[#D4AF37]'
                  }`}
                >
                  {isBulbOn ? 'FLUORESCENT ON' : 'CLICK BULB TO LIGHT ON'}
                </span>
              </div>

              {/* Right Metallic Socket Cap */}
              <div className="h-8 w-5 rounded-r-md bg-gradient-to-b from-neutral-300 via-neutral-500 to-neutral-700 border border-neutral-400/60 shadow-inner shrink-0 flex flex-col items-center justify-center gap-1">
                <span className="h-1 w-2 rounded-full bg-neutral-800/70" />
                <span className="h-1 w-2 rounded-full bg-neutral-800/70" />
              </div>

              {/* Tactile Pull-Cord Switch on Right Side */}
              <div className="absolute -right-1 top-6 flex flex-col items-center">
                <div
                  className={`w-0.5 transition-all duration-200 ${
                    isBulbOn
                      ? 'h-8 bg-[#D4AF37]'
                      : 'h-6 bg-neutral-500 group-hover:h-7 group-hover:bg-[#D4AF37]'
                  }`}
                />
                <div
                  className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    isBulbOn
                      ? 'bg-[#D4AF37] border-white shadow-[0_0_12px_rgba(212,175,55,0.9)]'
                      : 'bg-[#420B17] border-[#D4AF37]/80 group-hover:scale-110'
                  }`}
                >
                  <Power
                    className={`h-2.5 w-2.5 ${
                      isBulbOn ? 'text-[#3A0A14]' : 'text-[#D4AF37]'
                    }`}
                  />
                </div>
              </div>
            </div>
          </button>

          {/* Status Prompt when Bulb is OFF */}
          {!isBulbOn && (
            <div className="mt-8 mb-4 text-center space-y-4 max-w-sm">
              <div className="space-y-1.5">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white/90">
                  Barobo National High School Library
                </h2>
                <p className="text-xs text-white/65 leading-relaxed">
                  Click the fluorescent bulb above to switch the light ON and
                  reveal the member role & name login form.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleBulb}
                className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-5 py-2.5 text-xs font-bold text-[#3A0A14] hover:bg-[#e5c247] transition-colors shadow-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Power className="h-4 w-4" />
                Switch ON Fluorescent Bulb
              </button>
            </div>
          )}
        </div>

        {/* ================================================================
            REVEALED ILLUMINATED LOGIN FORM (Visible when Fluorescent Bulb is ON)
           ================================================================ */}
        {isBulbOn && (
          <form
            onSubmit={handleSubmit}
            className="fluorescent-form-reveal relative z-10 mx-4 sm:mx-6 mb-5 rounded-xl bg-white text-[#1E1B18] border border-[#D4AF37]/60 shadow-[0_12px_36px_rgba(0,0,0,0.45)] overflow-hidden"
          >
            <div className="bg-[#420B17] px-5 py-3.5 text-white flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold leading-snug">
                  BNHS Member Portal Login
                </h3>
                <p className="text-[11px] text-[#D4AF37]">
                  Choose your role, then scroll to select your registered name
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleBulb}
                className="rounded-md border border-[#D4AF37]/50 bg-[#2D070F] px-2.5 py-1 text-[11px] font-semibold text-[#D4AF37] hover:bg-[#3A0A14] whitespace-nowrap shrink-0"
              >
                Switch OFF
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Step 1: Select User Role (Exact 6 Requested Roles) */}
              <div>
                <label
                  htmlFor="fluorescent-role-select"
                  className="block font-bold text-[#641526] mb-1.5"
                >
                  1. Select Your User Role
                </label>
                <select
                  id="fluorescent-role-select"
                  value={selectedRole}
                  onChange={(e) => {
                    setSelectedRole(e.target.value as UserRole);
                    setMemberSearch('');
                  }}
                  className="w-full rounded-lg border-2 border-[#641526]/30 bg-white px-3 py-2.5 text-xs font-semibold text-neutral-900 focus:border-[#641526] focus:outline-none"
                >
                  {USER_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Scrollable Member Name List with Visible Scrollbar */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-[#641526]">
                    2. Choose Your Name ({selectedRole})
                  </label>
                  <span className="font-mono text-[11px] text-neutral-500 tabular-nums">
                    {roleMembers.length}{' '}
                    {roleMembers.length === 1 ? 'member' : 'members'} · Use
                    scrollbar to browse
                  </span>
                </div>

                {/* Quick Filter Search */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder={`Filter ${selectedRole} names or ID / LRN...`}
                    className="w-full rounded-lg border border-neutral-300 bg-neutral-50 pl-8 pr-3 py-2 text-xs text-neutral-900 focus:bg-white focus:border-[#641526] focus:outline-none"
                  />
                </div>

                {/* Dedicated Scrollbar Container for Choosing Member Name */}
                <div className="h-48 overflow-y-scroll bnhs-member-scrollbar rounded-lg border border-neutral-300 bg-neutral-50/70 divide-y divide-neutral-200 p-1">
                  {roleMembers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-4 text-center text-neutral-500 space-y-1">
                      <UserCheck className="h-5 w-5 text-neutral-400" />
                      <div className="font-semibold text-neutral-700">
                        No registered members found for "{selectedRole}"
                      </div>
                      <div className="text-[11px]">
                        Add new accounts in the consolidated "Add or Create"
                        menu or clear your search filter.
                      </div>
                    </div>
                  ) : (
                    roleMembers.map((member) => {
                      const isSelected = selectedMember?.id === member.id;
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setSelectedMemberId(member.id)}
                          onDoubleClick={() => void handleLoginMember(member)}
                          className={`w-full text-left px-3 py-2.5 rounded-md flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#641526] text-white shadow-xs'
                              : 'bg-white text-neutral-900 hover:bg-[#641526]/10'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate">
                              {member.fullName}
                            </div>
                            <div
                              className={`text-[11px] truncate ${
                                isSelected
                                  ? 'text-[#D4AF37]'
                                  : 'text-neutral-500'
                              }`}
                            >
                              <span className="font-mono">
                                {member.idNumber}
                              </span>{' '}
                              · {member.gradeOrDepartment}
                            </div>
                          </div>
                          {isSelected ? (
                            <CheckCircle2 className="h-4 w-4 text-[#D4AF37] shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-neutral-400 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 space-y-2.5">
                <button
                  type="submit"
                  disabled={!selectedMember || submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#641526] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#4d0f1d] disabled:opacity-45 transition-colors cursor-pointer"
                >
                  <LogIn className="h-4 w-4 text-[#D4AF37]" />
                  <span>
                    {submitting
                      ? 'Signing In...'
                      : selectedMember
                      ? `Sign In as ${selectedMember.fullName}`
                      : 'Select a Member Name Above'}
                  </span>
                </button>

                <div className="pt-2 border-t border-neutral-200 flex items-center justify-between gap-2 text-[11px] text-neutral-600">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                    <span>
                      Cloud Auto-Save is active automatically — no Google Sign-In required.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
