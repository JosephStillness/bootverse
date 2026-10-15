import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { FootProfileForm } from "./foot-profile-form";
describe("foot profile privacy and accessible defaults",()=>{
  it("renders empty optional measurements in a POST form, never placing measurements in a URL",()=>{
    const html=renderToStaticMarkup(<FootProfileForm profile={null}/>);
    expect(html).toContain('method="post"');
    expect(html).toContain('type="submit"');
    for(const id of ["leftLengthMm","rightLengthMm","leftWidthMm","rightWidthMm"]){
      expect(html).toContain(`id="foot-${id}"`);expect(html).toContain(`for="foot-${id}"`);
    }
    expect(html).toContain('name="leftLengthMm"');expect(html).toContain("No foot profile saved yet");
    expect(html).not.toContain('value="267');expect(html).not.toContain('name="userId"');
  });
  it("renders the same currency choices even when browser ICU differs",()=>{
    const original=Intl.supportedValuesOf;
    Intl.supportedValuesOf=(()=>["ZZZ"]) as typeof Intl.supportedValuesOf;
    try { const html=renderToStaticMarkup(<FootProfileForm profile={null}/>); expect(html).toContain('value="USD"'); expect(html).not.toContain('value="ZZZ"'); }
    finally {Intl.supportedValuesOf=original;}
  });
  it("explains privacy, independent review history and a measurement guide without automatic sharing",()=>{
    const html=renderToStaticMarkup(<FootProfileForm profile={null}/>);
    expect(html).toContain("Private by default");expect(html).toContain("heel gently against the wall");
    expect(html).toContain("never rewrites historical reviews");
    expect(html).toContain("FG is not automatically safe");
    expect(html).not.toContain('name="allowFitFinder" checked');
  });
});
