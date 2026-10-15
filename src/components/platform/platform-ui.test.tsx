import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { ReviewForm } from "@/components/reviews/review-form";
import { DecisionForm } from "./admin-dashboard";
import { CreatorForm } from "./creator-form";
import { ReportControl } from "./report-control";
import { VideoPanel } from "./video-panel";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh(){}}),usePathname:()=>"/qa"}));
import { VerifiedCreatorBadge } from "./verified-badge";
import { VideoEmbed } from "./video-panel";
import { authorDTO } from "@/lib/platform/public-author";
describe("creator identity and embed rendering", () => {
    it("new creator, reporting and video forms use explicit submit buttons",()=>{
      for(const component of [createElement(DecisionForm,{endpoint:"/api/admin/reports/qa",done:()=>{}}),createElement(CreatorForm,{creator:null}),createElement(ReportControl,{kind:"POST",id:"qa"}),createElement(VideoPanel,{kind:"POST",id:"qa",editable:true})]){
        expect(renderToStaticMarkup(component)).toMatch(/<button[^>]*type="submit"/);
      }
    });

    it("mutation forms keep submitted data out of query strings without JavaScript",()=>{
      for(const component of [createElement(ReviewForm,{variantId:"qa"}),createElement(CreatorForm,{creator:null}),createElement(ReportControl,{kind:"POST",id:"qa"}),createElement(DecisionForm,{endpoint:"/api/admin/reports/qa",done:()=>{}}),createElement(VideoPanel,{kind:"POST",id:"qa",editable:true})])expect(renderToStaticMarkup(component)).toMatch(/<form[^>]*method="post"/);
    });
    it("only badges an approved, public creator", () => {
        const profile = { username: "test", displayName: "Test", images: [] };
        for (const creator of [null, { status: "HIDDEN", verificationStatus: "APPROVED" }, { status: "PUBLISHED", verificationStatus: "PENDING" }])
            expect(authorDTO({ profile, creator }).verifiedCreator).toBe(false);
        expect(authorDTO({ profile, creator: { status: "PUBLISHED", verificationStatus: "APPROVED" } }).verifiedCreator).toBe(true);
        expect(renderToStaticMarkup(createElement(VerifiedCreatorBadge, { verified: false }))).toBe("");
        expect(renderToStaticMarkup(createElement(VerifiedCreatorBadge, { verified: true }))).toContain("ownership was checked");
    });
    it("requires a click before connecting to YouTube and escapes titles", () => {
        const html = renderToStaticMarkup(createElement(VideoEmbed, { video: { id: "test", videoId: "dQw4w9WgXcQ", title: "<script>test</script>", sponsorship: "QA only" } }));
        expect(html).not.toContain("<iframe");
        expect(html).toContain("Load YouTube player");
        expect(html).toContain("Watch on YouTube");
        expect(html).toContain("&lt;script&gt;");
        expect(html).toContain("Sponsored:");
        expect(renderToStaticMarkup(createElement(VideoEmbed, { video: { id: "test", videoId: "../bad", title: "Test", sponsorship: null } }))).toContain("Video unavailable");
    });
});
